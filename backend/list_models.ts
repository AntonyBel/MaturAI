import fetch from "node-fetch";
async function list() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
  const data = await res.json();
  console.log(data.models.map((m: any) => m.name));
}
list();
