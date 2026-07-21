from enum import Enum


class Role(str, Enum):
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


PERMISSIONS = {
    Role.ADMIN: ["workspace:*", "agent:*", "workflow:*", "memory:*", "run:*", "settings:*", "members:*"],
    Role.MEMBER: ["agent:*", "workflow:*", "memory:*", "run:*", "workspace:read"],
    Role.VIEWER: ["workspace:read", "agent:read", "workflow:read", "memory:read", "run:read"],
}


def check_permission(role: Role, permission: str) -> bool:
    perms = PERMISSIONS.get(role, [])
    for p in perms:
        if p.endswith(":*"):
            prefix = p[:-2]
            if permission.startswith(prefix):
                return True
        elif p == permission:
            return True
    return False
