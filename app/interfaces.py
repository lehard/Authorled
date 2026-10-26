"""Reach OS Manager through MCP."""

from os import getenv

from agno.os import AgentOS, AgentOSBuiltinAuth, MCPConfig


def mcp_auth(agentos_url: str) -> AgentOSBuiltinAuth | None:
    """Enable MCP OAuth when the MCP_CONNECT_SECRET is provided."""
    secret = getenv("MCP_CONNECT_SECRET")
    if not secret:
        return None
    return AgentOSBuiltinAuth(url=agentos_url, secret=secret)


def attach_interfaces(agent_os: AgentOS) -> None:
    """Publish agno alongside the built-in MCP tools."""
    manager = agent_os.manager
    if manager is None:
        raise RuntimeError("OS Manager must be configured before attaching interfaces.")
    agent_os.mcp = MCPConfig(
        default_tools=True,
        tools=[
            manager.as_tool(
                name="agno",
                title="Agno",
                description="Talk to OS Manager of this AgentOS. Pass session_id back to continue the conversation.",
            )
        ],
    )
