import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { logger } from "./utils/index.js";
// Import specific services if needed for direct injection or setup
// import { ExampleService } from "./services/index.js";

const serverConfig = {
    name: "mcp-server-template", // Use project name here
    version: "1.0.0",
    // Add any other server-level config if needed
};

// Define server capabilities - tools will be added dynamically by registerTools
const serverCapabilities = {
    capabilities: {
        tools: {} // Placeholder, tools register themselves
    }
};

export const createServer = (): McpServer => {
    logger.info("Creating MCP server instance...");

    // Create a new MCP server
    const server = new McpServer(
        serverConfig,
        serverCapabilities
    );

    // Optional: Instantiate singleton services here if needed globally
    // const exampleService = new ExampleService();

    // Set up global error handler for the server
    server.server.onerror = (error) => {
        // This catches errors within the MCP message handling layer
        logger.error("MCP Server Internal Error:", error);
        // Depending on the error, you might want to gracefully shutdown or just log
    };

    // Register all defined tools
    // Pass the server instance and potentially singleton services or configs
    registerTools(server);

    logger.info("MCP Server instance created and tools registered.");
    return server;
};
