'use strict';

// Draft projection only. It is not connected to the site or a publisher: even
// permitted free-text fields need human review before any real data is public.
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
function rows(value,fields,required){
  if(!Array.isArray(value)) return [];
  return value.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)&&
    hasOwn(item,required)&&typeof item[required]==='string'&&item[required].trim()).map(item=>{
      const result={};
      for(const field of fields) if(hasOwn(item,field)&&typeof item[field]==='string') result[field]=item[field];
      return result;
    });
}
function publicRegister(input){
  const data=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  return {
    trainings:rows(hasOwn(data,'trainings')?data.trainings:null,['id','title','start','end','location'],'title'),
    equipment:rows(hasOwn(data,'equipment')?data.equipment:null,['id','name','status'],'name')
  };
}
module.exports={publicRegister};
