"""
worker/jobs/ports.py
--------------------
Pure infrastructure module for host-port allocation.
No DB access, no status updates.
"""

PORT_MIN = 8001
PORT_MAX = 8999


class PortAllocationError(Exception):
    """Raised when no host ports remain in the allocation range."""
    pass


def allocate_port(used_ports: set[int]) -> int:
    """
    Return the lowest available host port in [PORT_MIN, PORT_MAX] not in used_ports.

    Args:
        used_ports: A set of integers representing ports currently in use.

    Returns:
        An integer port number in [PORT_MIN, PORT_MAX].

    Raises:
        PortAllocationError: if all ports in the range are in used_ports.
    """
    for port in range(PORT_MIN, PORT_MAX + 1):
        if port not in used_ports:
            return port

    raise PortAllocationError(
        f"No available ports in range {PORT_MIN}–{PORT_MAX}: "
        f"all {PORT_MAX - PORT_MIN + 1} ports are currently allocated."
    )
