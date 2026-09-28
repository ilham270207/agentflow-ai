import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

function durationFromGoal(goal) {
  const match = goal.match(/(\d+)\s*(day|days|week|weeks)/i);
  if (!match) return 7;
  const n = Number(match[1]);
  return /week/i.test(match[2]) ? Math.max(3, Math.min(30, n * 7)) : Math.max(3, Math.min(30, n));
}

function detectType(goal) {
  const g = goal.toLowerCase();
  if (/website|web app|portfolio|landing page|app|software|saas/.test(g)) return "web";
  if (/store|business|startup|shop|ecommerce|sell/.test(g)) return "business";
  if (/learn|study|javascript|python|exam|course/.test(g)) return "learning";
  if (/content|youtube|instagram|blog|social|video/.test(g)) return "content";
  if (/fitness|workout|run|gym|exercise/.test(g)) return "fitness";
  return "general";
}

const templates = {
  web: [
    ["Define scope and success criteria","Write the core pages, audience, required features, and definition of done.","Planning"],
    ["Plan the experience","Sketch the page structure, user flow, content, and mobile layout.","Planning"],
    ["Build the first working version","Create the main structure and implement the highest-priority feature.","Build"],
    ["Add content and polish","Add real copy, visuals, responsive styling, and useful interactions.","Build"],
    ["Test and fix issues","Test key flows on mobile and desktop, then fix the biggest problems.","Quality"],
    ["Prepare the launch","Add basic metadata, verify links, and prepare the project for deployment.","Launch"],
    ["Deploy and review","Publish the project, test the live version, and record final improvements.","Launch"]
  ],
  business: [
    ["Define the offer","Clarify the product, customer, value proposition, and success criteria.","Strategy"],
    ["Research the market","Review competitors, customer needs, pricing, and positioning.","Research"],
    ["Design the customer journey","Map discovery, purchase, onboarding, and retention steps.","Strategy"],
    ["Build the storefront","Create the core pages, catalog, checkout flow, and trust elements.","Build"],
    ["Prepare operations","Set fulfillment, support, policies, analytics, and launch checklist.","Operations"],
    ["Test the buying flow","Run end-to-end tests on mobile and desktop and fix blockers.","Quality"],
    ["Launch and review","Publish the store, monitor early signals, and prioritize improvements.","Launch"]
  ],
  learning: [
    ["Define the learning target","Choose the exact skill, outcome, and level you want to reach.","Planning"],
    ["Build a study roadmap","Split the subject into concepts and sequence them from fundamentals to practice.","Planning"],
    ["Learn the fundamentals","Study the highest-leverage concepts and create short notes.","Learn"],
    ["Practice with small exercises","Apply the concepts through focused exercises and examples.","Practice"],
    ["Build a mini project","Use the new skill in a small practical project.","Practice"],
    ["Review weak areas","Test yourself, identify gaps, and revisit difficult concepts.","Review"],
    ["Create a next-step plan","Summarize what you learned and define the next level of practice.","Review"]
  ],
  content: [
    ["Define the audience","Choose the audience, topic, format, and measurable goal.","Strategy"],
    ["Create the content system","Set themes, formats, publishing cadence, and reusable templates.","Planning"],
    ["Draft the first batch","Create the first set of posts, scripts, or articles.","Create"],
    ["Edit and package","Improve hooks, clarity, visuals, titles, and calls to action.","Create"],
    ["Prepare publishing","Schedule content, check links, and prepare descriptions and metadata.","Launch"],
    ["Publish and observe","Release the first batch and record useful audience signals.","Launch"],
    ["Review and iterate","Use the results to refine topics, formats, and the next batch.","Review"]
  ],
  fitness: [
    ["Set the outcome","Define the target, current baseline, schedule, and constraints.","Planning"],
    ["Design the routine","Choose sessions, duration, recovery, and progression.","Planning"],
    ["Start consistently","Complete the first sessions and record how they feel.","Execute"],
    ["Adjust the workload","Review effort and recovery, then make small adjustments.","Execute"],
    ["Track progress","Record sessions and compare against the original goal.","Review"],
    ["Improve consistency","Remove practical blockers and strengthen the routine.","Review"],
    ["Review the cycle","Summarize progress and set the next realistic milestone.","Review"]
  ],
  general: [
    ["Clarify the outcome","Define the desired result, constraints, and definition of done.","Planning"],
    ["Break the goal into steps","Identify the smallest useful actions and dependencies.","Planning"],
    ["Start the first execution step","Complete the highest-priority action and record what you learn.","Execute"],
    ["Review and adjust","Check progress, remove blockers, and refine the plan.","Review"],
    ["Continue execution","Complete the next priority tasks and keep the workflow moving.","Execute"],
    ["Prepare the finish","Verify the key requirements and resolve remaining blockers.","Review"],
    ["Complete and review","Finish the goal, capture lessons, and define useful next steps.","Finish"]
  ]
};

function localPlan(goal) {
  const duration = durationFromGoal(goal);
  const type = detectType(goal);
  const base = templates[type];
  const count = Math.min(duration, 7);
  const tasks = base.slice(0, count).map((t, i) => ({
    id: `${Date.now()}-${i}`,
    day: i + 1,
    title: t[0],
    description: t[1],
    category: t[2],
    priority: i < 2 ? "High" : i < 5 ? "Medium" : "Low",
    estimate: i < 2 ? "45–60 min" : "30–45 min"
  }));
  return {
    goal,
    duration,
    type,
    mode: "local",
    summary: `${duration}-day workflow · ${type} workflow · local demo mode`,
    tasks
  };
}

async function tryAI(goal) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        input: `Create a practical workflow for this goal: ${goal}. Return JSON with a short summary and 5-7 tasks. Each task must have title, description, category, priority, estimate.`
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.output_text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.tasks)) return null;
    return {...parsed, goal, duration: durationFromGoal(goal), type: detectType(goal), mode: "ai"};
  } catch {
    return null;
  }
}

app.post("/api/plan", async (req, res) => {
  const goal = String(req.body?.goal || "").trim();
  if (!goal) return res.status(400).json({ error: "Please enter a goal." });
  const ai = await tryAI(goal);
  res.json(ai || localPlan(goal));
});

app.get("/api/health", (_req, res) => res.json({ ok: true, version: "1.2.0" }));

app.listen(port, "0.0.0.0", () => {
  console.log(`AgentFlow AI v1.2 running on port ${port}`);
});
