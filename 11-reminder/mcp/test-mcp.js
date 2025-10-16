#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";

let apiServer;

async function startAPIServer() {
  console.log("🚀 Starting API server...");
  apiServer = spawn("node", ["src/api/server.js"], {
    stdio: "ignore",
    detached: false
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log("✓ API server started\n");
}

async function stopAPIServer() {
  if (apiServer) {
    console.log("\n🛑 Stopping API server...");
    apiServer.kill();
  }
}

async function testMCP() {
  console.log("🧪 Testing MCP Server\n");
  
  await startAPIServer();

  // Create transport that will spawn the MCP server
  const transport = new StdioClientTransport({
    command: "node",
    args: ["mcp/server.js"],
  });

  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);
  console.log("✓ Connected to MCP server\n");

  // List tools
  const tools = await client.listTools();
  console.log("📋 Available tools:");
  tools.tools.forEach((tool) => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });
  console.log();

  // Test 1: Create a task
  console.log("📝 Test 1: Creating a task...");
  const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
  const createResult = await client.callTool({
    name: "create_task",
    arguments: {
      name: "Test Task",
      description: "This is a test task",
      date: tomorrow.toString(),
    },
  });
  console.log("Result:", createResult.content[0].text);
  console.log();

  // Test 2: Get all tasks
  console.log("📋 Test 2: Getting all tasks...");
  const getAllResult = await client.callTool({
    name: "get_all_tasks",
    arguments: {},
  });
  const allTasks = JSON.parse(getAllResult.content[0].text);
  console.log("Result:", getAllResult.content[0].text);
  console.log();

  if (allTasks.tasks && allTasks.tasks.length > 0) {
    const taskId = allTasks.tasks[0].id;

    // Test 3: Get tasks for tomorrow
    console.log("📅 Test 3: Getting tasks for tomorrow...");
    const getDateResult = await client.callTool({
      name: "get_tasks_for_date",
      arguments: {
        date: tomorrow.toString(),
      },
    });
    console.log("Result:", getDateResult.content[0].text);
    console.log();

    // Test 4: Complete task
    console.log("✅ Test 4: Completing task...");
    const completeResult = await client.callTool({
      name: "complete_task",
      arguments: {
        id: taskId,
      },
    });
    console.log("Result:", completeResult.content[0].text);
    console.log();

    // Test 5: Delete task
    console.log("🗑️  Test 5: Deleting task...");
    const deleteResult = await client.callTool({
      name: "delete_task",
      arguments: {
        id: taskId,
      },
    });
    console.log("Result:", deleteResult.content[0].text);
    console.log();
  }

  console.log("✅ All tests completed!");
  
  await stopAPIServer();
  process.exit(0);
}

testMCP().catch(async (error) => {
  console.error("❌ Test failed:", error);
  await stopAPIServer();
  process.exit(1);
});

