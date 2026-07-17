import { createClient } from "@supabase/supabase-js";

// Helper function to paginate FUB resources
async function fubPaginate(
  baseUrl: string,
  headers: Record<string, string>,
  collectionKey: string,
  maxPages = 5
): Promise<any[]> {
  const out: any[] = [];
  for (let page = 0; page < maxPages; page++) {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${sep}limit=100&offset=${page * 100}`;
    const res = await fetch(url, { headers });
    if (!res.ok) break;
    const data = await res.json() as any;
    if (!data) break;
    const items = data[collectionKey] ?? [];
    out.push(...items);
    const total = data?._metadata?.total;
    if (items.length < 100) break;
    if (typeof total === "number" && out.length >= total) break;
  }
  return out;
}

// 1. Tool: search_people handler
async function handleSearchPeople(input: any, apiKey: string) {
  const { stage, source, tag, last_contact_before, limit = 50 } = input;
  const coercedLimit = Math.min(Number(limit) || 50, 50);

  const queryParams = new URLSearchParams();
  queryParams.append("limit", String(coercedLimit));
  queryParams.append("sort", "-updated");

  if (stage) queryParams.append("stage", stage);
  if (source) queryParams.append("source", source);
  if (tag) queryParams.append("tag", tag);
  if (last_contact_before) queryParams.append("lastActivityBefore", last_contact_before);

  const headers = {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    "X-System": "MSREG-Marketing-Dashboard",
    "X-System-Key": apiKey,
    Accept: "application/json",
  };

  // Run user fetch and people query in parallel to resolve agent names
  const [usersR, peopleR] = await Promise.all([
    fetch("https://api.followupboss.com/v1/users?limit=100", { headers }).then((r) => r.json()),
    fetch(`https://api.followupboss.com/v1/people?${queryParams.toString()}`, { headers }).then((r) => r.json())
  ]);

  const userMap = new Map<number, string>();
  const users = usersR?.users ?? [];
  for (const u of users) {
    userMap.set(
      u.id,
      u.name || [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || `User #${u.id}`
    );
  }

  const people = peopleR?.people ?? [];
  return people.map((p: any) => ({
    id: p.id,
    name: p.name || [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Unnamed",
    stage: p.stage || "Unknown",
    source: p.source || "Unknown",
    assignedAgent: userMap.get(p.assignedUserId) || "Unknown",
    lastActivityDate: p.lastActivity || p.updated || null,
  }));
}

// 2. Tool: get_pipeline_summary handler
async function handleGetPipelineSummary(input: any, apiKey: string) {
  const { pipeline_id } = input;

  const headers = {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    "X-System": "MSREG-Marketing-Dashboard",
    "X-System-Key": apiKey,
    Accept: "application/json",
  };

  const [stagesR, pipelinesR, dealsList] = await Promise.all([
    fetch("https://api.followupboss.com/v1/stages?limit=100", { headers }).then((r) => r.json()),
    fetch("https://api.followupboss.com/v1/pipelines?limit=50", { headers }).then((r) => r.json()),
    fubPaginate("https://api.followupboss.com/v1/deals", headers, "deals", 5),
  ]);

  const stages = stagesR?.stages ?? [];
  const pipelines = pipelinesR?.pipelines ?? [];

  const pipelineMap = new Map<number, string>();
  for (const p of pipelines) {
    pipelineMap.set(p.id, p.name);
  }

  const stageMap = new Map<number, { name: string; pipelineId?: number }>();
  for (const s of stages) {
    stageMap.set(s.id, { name: s.name, pipelineId: s.pipelineId });
  }

  const aggregation: Record<string, { stageName: string; pipelineName: string; count: number; totalValue: number }> = {};

  for (const d of dealsList) {
    const dealPipelineId = d.pipelineId;
    if (pipeline_id && String(dealPipelineId) !== String(pipeline_id)) {
      continue;
    }

    const stageId = d.stageId;
    const stageInfo = stageMap.get(stageId);
    const stageName = stageInfo?.name || d.stage?.name || `Stage #${stageId}`;
    const pipelineName = pipelineMap.get(dealPipelineId) || `Pipeline #${dealPipelineId}`;

    const key = `${dealPipelineId}-${stageName}`;
    if (!aggregation[key]) {
      aggregation[key] = {
        stageName,
        pipelineName,
        count: 0,
        totalValue: 0,
      };
    }
    aggregation[key].count += 1;
    aggregation[key].totalValue += Number(d.price) || 0;
  }

  return Object.values(aggregation).map((a) => ({
    pipeline: a.pipelineName,
    stage: a.stageName,
    count: a.count,
    totalValue: a.totalValue,
  }));
}

// 3. Tool: get_lead_sources handler
async function handleGetLeadSources(input: any, apiKey: string) {
  const { start_date, end_date } = input;

  const headers = {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    "X-System": "MSREG-Marketing-Dashboard",
    "X-System-Key": apiKey,
    Accept: "application/json",
  };

  let createdAfter = start_date;
  if (createdAfter && /^\d{4}-\d{2}-\d{2}$/.test(createdAfter)) {
    createdAfter = `${createdAfter}T00:00:00Z`;
  }
  let createdBefore = end_date;
  if (createdBefore && /^\d{4}-\d{2}-\d{2}$/.test(createdBefore)) {
    createdBefore = `${createdBefore}T23:59:59Z`;
  }

  const queryParams = new URLSearchParams();
  if (createdAfter) queryParams.append("createdAfter", createdAfter);
  if (createdBefore) queryParams.append("createdBefore", createdBefore);
  queryParams.append("fields", "id,source,stage");

  const peopleList = await fubPaginate(
    `https://api.followupboss.com/v1/people?${queryParams.toString()}`,
    headers,
    "people",
    5
  );

  const sourceAggregation: Record<string, { total: number; stages: Record<string, number> }> = {};

  for (const p of peopleList) {
    const source = p.source || "Unknown";
    const stage = p.stage || "Unknown";

    if (!sourceAggregation[source]) {
      sourceAggregation[source] = { total: 0, stages: {} };
    }
    sourceAggregation[source].total += 1;
    sourceAggregation[source].stages[stage] = (sourceAggregation[source].stages[stage] || 0) + 1;
  }

  return Object.entries(sourceAggregation)
    .map(([source, data]) => ({
      source,
      totalCount: data.total,
      stageBreakdown: data.stages,
    }))
    .sort((a, b) => b.totalCount - a.totalCount);
}

// Define tools available to Claude
const TOOLS = [
  {
    name: "search_people",
    description: "Search and retrieve list of contacts/leads from Follow Up Boss. Returns whitelisted fields: id, name, stage, source, assigned agent, and last activity date.",
    input_schema: {
      type: "object",
      properties: {
        stage: {
          type: "string",
          description: "Optional pipeline stage (e.g. Lead, Hot Lead, Closed, Trash)",
        },
        source: {
          type: "string",
          description: "Optional lead source (e.g. Zillow, Website, Realtor.com)",
        },
        tag: {
          type: "string",
          description: "Optional tag name (comma-separated for multiple tags)",
        },
        last_contact_before: {
          type: "string",
          description: "Optional ISO-8601 timestamp to filter people who had activity before this date",
        },
        limit: {
          type: "integer",
          description: "Maximum number of contacts to return (default 50, maximum 50)",
          minimum: 1,
          maximum: 50,
        },
      },
    },
  },
  {
    name: "get_pipeline_summary",
    description: "Aggregate active deals from Follow Up Boss by stage, summing the count and total values. Returns whitelisted fields: pipeline, stage, count, and totalValue.",
    input_schema: {
      type: "object",
      properties: {
        pipeline_id: {
          type: "string",
          description: "Optional numeric pipeline ID to filter deals from a single pipeline.",
        },
      },
    },
  },
  {
    name: "get_lead_sources",
    description: "Aggregate and break down leads created within a date range by lead source and stage. Returns whitelisted fields: source, totalCount, and stageBreakdown.",
    input_schema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start date (ISO-8601 or YYYY-MM-DD)",
        },
        end_date: {
          type: "string",
          description: "End date (ISO-8601 or YYYY-MM-DD)",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
];

// Netlify Function handler
export async function handler(event: any, context: any) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // 1. Read environment variables
  const fubApiKey = process.env.FUB_API_KEY || process.env.FUB;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!fubApiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "FUB_API_KEY is not configured on the server." }),
    };
  }
  if (!anthropicApiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured on the server." }),
    };
  }
  if (!supabaseUrl || !supabasePublishableKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Supabase environment variables are missing on the server." }),
    };
  }

  // 2. Validate JWT token
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Unauthorized: Missing authorization header." }),
    };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Unauthorized: Invalid token." }),
    };
  }

  // 3. Confirm admin role
  const { data: rolesData, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (rolesError) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to retrieve user roles." }),
    };
  }

  const isAdmin = (rolesData ?? []).some((r: any) => r.role === "admin");
  if (!isAdmin) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: "Forbidden: Admin role check failed." }),
    };
  }

  // 4. Accept message history
  let requestBody: any;
  try {
    requestBody = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON body." }),
    };
  }

  const { messages } = requestBody;
  if (!Array.isArray(messages)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "messages array is required." }),
    };
  }

  // 5. Agentic Loop
  const currentMessages = [...messages];
  let iterations = 0;
  let finalResponseText = "";

  try {
    while (iterations < 5) {
      iterations++;

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          system: "You are a CRM analyst for Matt Smith Real Estate Group, operating across Rolla, St. Robert, and Lake of the Ozarks. Use the provided tools to answer questions about lead and deal data. Cite specific numbers. If the data doesn't support a conclusion, say so rather than speculating.",
          tools: TOOLS,
          messages: currentMessages,
        }),
      });

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ error: `Anthropic API error (${claudeRes.status}): ${errText}` }),
        };
      }

      const result = (await claudeRes.json()) as any;

      // Add Claude's reply to the message list
      currentMessages.push({
        role: "assistant",
        content: result.content,
      });

      if (result.stop_reason !== "tool_use") {
        const textBlock = result.content.find((c: any) => c.type === "text");
        finalResponseText = textBlock ? textBlock.text : "";
        break;
      }

      // Handle tool calls
      const toolUses = result.content.filter((c: any) => c.type === "tool_use");
      const toolResultsContent = [];

      for (const toolUse of toolUses) {
        const { name, input, id: toolUseId } = toolUse;
        let toolResultData;

        try {
          if (name === "search_people") {
            toolResultData = await handleSearchPeople(input, fubApiKey);
          } else if (name === "get_pipeline_summary") {
            toolResultData = await handleGetPipelineSummary(input, fubApiKey);
          } else if (name === "get_lead_sources") {
            toolResultData = await handleGetLeadSources(input, fubApiKey);
          } else {
            throw new Error(`Tool ${name} is not defined.`);
          }
        } catch (err: any) {
          toolResultData = { error: err.message || String(err) };
        }

        toolResultsContent.push({
          type: "tool_result",
          tool_use_id: toolUseId,
          content: JSON.stringify(toolResultData),
        });
      }

      // Push tool results back to Claude
      currentMessages.push({
        role: "user",
        content: toolResultsContent,
      });
    }

    if (!finalResponseText && currentMessages.length > 0) {
      const lastAssMessage = currentMessages[currentMessages.length - 1];
      if (lastAssMessage.role === "assistant") {
        const textBlock = lastAssMessage.content?.find?.((c: any) => c.type === "text");
        finalResponseText = textBlock ? textBlock.text : "Tool execution completed. Limit reached.";
      } else {
        finalResponseText = "Tool execution loop completed without returning text response.";
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ response: finalResponseText }),
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
}
