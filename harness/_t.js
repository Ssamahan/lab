const {boot}=require('./env');
(async()=>{
  const {w}=await boot('#/training');
  const db=w.LS.store.db();
  console.log('trainings',db.trainings.length);
  console.log(JSON.stringify(db.trainings[0]));
  console.log(JSON.stringify(db.trainings[db.trainings.length-1]));
  console.log('rev',JSON.stringify((db.trainingExpenses||[])[0]));
  process.exit(0);
})();
