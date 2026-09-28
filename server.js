import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

function detectType(goal) {
  const g = goal.toLowerCase();
  if (/(website|web app|portfolio|landing page|frontend|backend|app)/.test(g)) return "web";
  if (/(business|shop|store|sell|ecommerce|online)/.test(g)) return "business";
  if (/(learn|study|course|exam|skill|coding|programming)/.test(g)) return "learning";
  if (/(content|youtube|instagram|tiktok|blog|social media|video)/.test(g)) return "content";
  if (/(fitness|workout|run|exercise|gym)/.test(g)) return "fitness";
  return "general";
}

function extractDays(goal) {
  const m = goal.match(/(\d+)\s*(day|days|hari|minggu|week|weeks)/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (/minggu|week/i.test(m[2])) return Math.max(5, n * 7);
  return Math.max(3, n);
}

function localPlan(goal) {
  const type = detectType(goal);
  const days = extractDays(goal);
  const horizon = days ? `${days}-day` : "practical";
  const plans = {
    web: [
      ["Define scope and success criteria", "Write the core pages, audience, required features, and definition of done."],
      ["Plan the experience", "Sketch the page structure, user flow, content, and mobile layout."],
      ["Build the first working version", "Create the main structure and implement the highest-priority feature."],
      ["Add content and polish", "Add real copy, visuals, responsive styling, and useful interactions."],
      ["Test and fix issues", "Test key flows on mobile and desktop, then fix the biggest problems."],
      ["Prepare the launch", "Add basic metadata, verify links, and prepare the project for deployment."],
      ["Deploy and review", "Publish the project, test the live version, and record final improvements."]
    ],
    business: [
      ["Define the offer", "Choose the target customer, product or service, value proposition, and price."],
      ["Validate demand", "Talk to potential customers or test the offer with a simple landing page."],
      ["Prepare the product", "Create the product, catalog, fulfillment process, and customer support flow."],
      ["Set up the sales channel", "Configure the store, payment method, checkout, and essential policies."],
      ["Create launch content", "Prepare product photos, descriptions, social posts, and a simple launch message."],
      ["Run a small launch", "Invite an initial audience, track questions and conversions, and collect feedback."],
      ["Review and improve", "Use the first results to improve the offer, funnel, and next actions."]
    ],
    learning: [
      ["Define the learning target", "Choose exactly what you want to be able to do and how you will measure progress."],
      ["Map the fundamentals", "List the core concepts and prerequisites you need before advanced material."],
      ["Create a study routine", "Set focused sessions, practice blocks, and a realistic daily target."],
      ["Learn by doing", "Complete exercises or a small project instead of only consuming material."],
      ["Test your understanding", "Use recall, quizzes, or practice problems to find weak areas."],
      ["Fix the gaps", "Review the hardest concepts and repeat the exercises you missed."],
      ["Demonstrate the skill", "Complete a small final project or practical test that proves what you learned."]
    ],
    content: [
      ["Define the audience and message", "Choose the target audience, topic, format, and desired action."],
      ["Build a content plan", "Create a short list of topics, hooks, formats, and publishing dates."],
      ["Create the first batch", "Draft and produce several pieces using one repeatable workflow."],
      ["Edit for clarity", "Improve the hook, structure, visuals, captions, and call to action."],
      ["Publish consistently", "Publish the first batch and keep the process simple enough to repeat."],
      ["Measure the response", "Track views, retention, clicks, saves, comments, or other useful signals."],
      ["Iterate", "Keep the formats that work and change one variable at a time."]
    ],
    fitness: [
      ["Set the target", "Define the outcome, current baseline, schedule, and constraints."],
      ["Choose a simple routine", "Select manageable sessions and decide how you will track them."],
      ["Start consistently", "Complete the first sessions at a sustainable intensity."],
      ["Track recovery", "Record energy, soreness, sleep, and anything that affects performance."],
      ["Progress gradually", "Increase duration, repetitions, or difficulty in small steps."],
      ["Review the routine", "Identify what is sustainable and adjust weak points."],
      ["Set the next milestone", "Review progress and choose the next measurable target."]
    ],
    general: [
      ["Clarify the outcome", "Define what success looks like, the deadline, and the most important constraints."],
      ["Break it into milestones", "Turn the goal into a small sequence of outcomes that can be completed."],
      ["Choose the first action", "Pick the smallest useful action and complete it today."],
      ["Execute the next priorities", "Work through the highest-impact tasks while recording blockers and decisions."],
      ["Review progress", "Compare the current state with the goal and remove anything that is slowing you down."],
      ["Refine the plan", "Reorder, remove, or add tasks based on what you learned."],
      ["Finish and verify", "Complete the remaining critical work and check the result against your success criteria."]
    ]
  };

  const template = plans[type];
  const taskCount = days && days <= 5 ? 5 : days && days <= 8 ? Math.min(7, days) : 7;
  const selected = template.slice(0, taskCount);
  return {
    title: goal.length > 58 ? goal.slice(0, 58) + "…" : goal,
    summary: `${horizon} workflow · ${type === "general" ? "goal planning" : type + " workflow"} · local demo mode`,
    tasks: selected.map(([title, detail], i) => ({
      day: i + 1,
      title,
      detail
    }))
  };
}

function extractText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n");
}

async function tryAI(goal) {
  if (!process.env.OPENAI_API_KEY) return null;

  const prompt = `You are AgentFlow AI, a planning agent.
Turn the user's goal into a practical workflow.
Return ONLY valid JSON:
{"title":"short title","summary":"one sentence","tasks":[{"day":1,"title":"task title","detail":"specific action"}]}
Create 5-8 sequential, concrete, realistic tasks.
User goal: ${goal}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      input: prompt
    })
  });

  if (!response.ok) return null;
  const data = await response.json();
  const text = extractText(data);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

app.post("/api/plan", async (req, res) => {
  const goal = clean(req.body?.goal);
  if (!goal) return res.status(400).json({ error: "Please enter a goal." });
  if (goal.length > 1000) return res.status(400).json({ error: "Goal is too long." });

  try {
    const aiPlan = await tryAI(goal);
    if (aiPlan?.tasks?.length) {
      return res.json({ mode: "ai", plan: aiPlan });
    }
  } catch {
    // Fall through to free local mode.
  }

  return res.json({ mode: "local", plan: localPlan(goal) });
});

app.listen(port, () => {
  console.log(`AgentFlow AI running at http://localhost:${port}`);
});
