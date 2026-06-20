import fetch from "node-fetch";
async function list() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1alpha/models?key=${process.env.GEMINI_API_KEY}`);
  const data = await res.json();
  const valid = data.models.filter((m: any) => m.supportedGenerationMethods.includes("bidiGenerateContent"));
  console.log(valid.map((m: any) => m.name));
}
list();
