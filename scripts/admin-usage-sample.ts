#!/usr/bin/env tsx

import 'dotenv/config';

const API_KEY = process.env.OPENAI_API_KEY;
const ORG = process.env.OPENAI_ORGANIZATION;
const PROJECT = process.env.OPENAI_PROJECT;

if (!API_KEY || !ORG || !PROJECT) {
  console.error('Missing OPENAI_API_KEY/OPENAI_ORGANIZATION/OPENAI_PROJECT');
  process.exit(1);
}

const start = Math.floor(Date.parse('2025-09-10T00:00:00Z') / 1000);
const end = Math.floor(Date.parse('2025-09-11T00:00:00Z') / 1000);

const url = new URL('https://api.openai.com/v1/organization/usage/completions');
url.searchParams.set('start_time', String(start));
url.searchParams.set('end_time', String(end));
url.searchParams.set('limit', '31');
url.searchParams.set('group_by', 'project_id,user_id,api_key_id,model,batch');

async function main() {
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Request failed', response.status, text);
    process.exit(1);
  }

  const json = await response.json();
  console.log(JSON.stringify(json, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
