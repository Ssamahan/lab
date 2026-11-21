'use strict';

// Draft projection only. It is not connected to the site or a publisher: even
// permitted free-text fields need human review before any real data is public.
function rows(value,fields,required){
  if(!Array.isArray(value)) return [];
  return value.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)&&
    typeof item[required]==='string'&&item[required].trim()).map(item=>{
      const result={};
      for(const field of fields) if(typeof item[field]==='string') result[field]=item[field];
      return result;
    });
}
function publicRegister(input){
  const data=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  return {
    trainings:rows(data.trainings,['id','title','start','end','location'],'title'),
    equipment:rows(data.equipment,['id','name','status'],'name')
  };
}
module.exports={publicRegister};
