import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
const url=Deno.env.get("SUPABASE_URL")!;
const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"};
const out=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
async function log(actor:string,action:string,id:string,details:Record<string,unknown>={}) {
 const {error}=await db.from("admin_audit").insert({actor_id:actor,relation_name:"auth.users",operation:action,record_id:id,new_data:details});
 if(error) throw error;
}
async function target(id:string){
 const {data,error}=await db.from("profiles").select("id,role,status").eq("id",id).single();
 if(error||!data)throw Error("Usuário não encontrado");
 return data;
}
async function lastAdminCheck(p:{role:string,status:string}){
 if(p.role!=="ADM"||p.status!=="ATIVO")return;
 const {count,error}=await db.from("profiles").select("id",{head:true,count:"exact"}).eq("role","ADM").eq("status","ATIVO");
 if(error)throw error;
 if((count??0)<=1)throw Error("O último ADM ativo não pode ser bloqueado ou rebaixado");
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return out(405,{error:"Método não permitido"});
 try{
  const authorization=req.headers.get("authorization")??"";
  if(!authorization.startsWith("Bearer "))return out(401,{error:"Sessão necessária"});
  const {data:auth,error:authError}=await db.auth.getUser(authorization.slice(7));
  if(authError||!auth.user)return out(401,{error:"Sessão inválida"});
  const actor=auth.user.id;
  const {data:me,error:meError}=await db.from("profiles").select("role,status").eq("id",actor).single();
  if(meError||me?.role!=="ADM"||me.status!=="ATIVO")return out(403,{error:"Acesso exclusivo ao administrador"});
  const body=await req.json().catch(()=>({}));
  if(body.action==="list"){
   const {data,error}=await db.from("profiles").select("id,full_name,role,serie,status,created_at").order("created_at",{ascending:false}).limit(500);
   if(error)throw error;
   return out(200,{users:data});
  }
  if(body.action==="create"){
   const full_name=typeof body.full_name==="string"?body.full_name.trim():"";
   const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
   const password=typeof body.password==="string"?body.password:"";
   const role=body.role;
   const serie=role==="ALUNO"&&typeof body.serie==="string"?body.serie.trim():null;
   if(!full_name||full_name.length>120)return out(400,{error:"Informe um nome de usuário de até 120 caracteres"});
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return out(400,{error:"Informe um e-mail válido"});
   if(password.length<8||password.length>128)return out(400,{error:"A senha deve ter entre 8 e 128 caracteres"});
   if(!["ADM","ALUNO","PROFESSOR"].includes(role))return out(400,{error:"Perfil inválido"});
   if(role==="ALUNO"&&(!serie||serie.length>60))return out(400,{error:"Informe a série do aluno (até 60 caracteres)"});
   const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name,serie},app_metadata:{role}});
   if(error)return out(400,{error:error.code==="email_exists"||error.code==="user_already_exists"?"Já existe uma conta com este e-mail":"Não foi possível criar a conta. Verifique o e-mail e os requisitos de senha."});
   if(!data.user)throw Error("O serviço não confirmou a criação da conta");
   // O trigger cria o perfil na mesma transação do usuário Auth.
   try{await log(actor,"CREATE",data.user.id,{full_name,role,serie});}
   catch{console.error("Falha de auditoria de criação",data.user.id);}
   return out(201,{ok:true,user:{id:data.user.id,full_name,role,serie}});
  }
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.user_id??""))return out(400,{error:"ID inválido"});
  const id=body.user_id;
  const p=await target(id);
  if(body.action==="set_role"){
   if(!["ADM","ALUNO","PROFESSOR"].includes(body.role))return out(400,{error:"Perfil inválido"});
   const serie=body.role==="ALUNO"&&typeof body.serie==="string"?body.serie.trim():null;
   if(body.role==="ALUNO"&&(!serie||serie.length>60))return out(400,{error:"Informe a série do aluno"});
   if(body.role!=="ADM")await lastAdminCheck(p);
   const {error}=await db.from("profiles").update({role:body.role,serie,updated_at:new Date().toISOString()}).eq("id",id);
   if(error)throw error;
   await log(actor,"ROLE",id,{role:body.role});
   return out(200,{ok:true});
  }
  if(body.action==="ban"){
   if(id===actor)return out(400,{error:"Não é possível bloquear a própria conta"});
   await lastAdminCheck(p);
   const {error:e}=await db.from("profiles").update({status:"BLOQUEADO",updated_at:new Date().toISOString()}).eq("id",id);
   if(e)throw e;
   const {error}=await db.auth.admin.updateUserById(id,{ban_duration:"876000h"});
   if(error)throw error;
   await log(actor,"BAN",id);
   return out(200,{ok:true});
  }
  if(body.action==="unban"){
   const {error}=await db.auth.admin.updateUserById(id,{ban_duration:"none"});
   if(error)throw error;
   const {error:e}=await db.from("profiles").update({status:"ATIVO",updated_at:new Date().toISOString()}).eq("id",id);
   if(e)throw e;
   await log(actor,"UNBAN",id);
   return out(200,{ok:true});
  }
  return out(400,{error:"Ação inválida"});
 }catch(error){console.error("Falha na operação administrativa");return out(400,{error:error instanceof Error?error.message:"Falha na operação"})}
});
