provider "keycloak" {
  # Client-credentials grant against the realm that hosts the client.
  client_id     = var.client_id
  client_secret = var.client_secret
  url           = var.keycloak_url
  realm         = var.realm
}

# One Keycloak user per roster member, keyed by EDIPI. We provision IDENTITY only: the username, name, email, and the `edipi` attribute that the DRP SSO client maps into the token. Roles are intentionally NOT set here — a member's role set lives in the roster DB (member_roles) and is resolved by the backend from this EDIPI.
resource "keycloak_user" "member" {
  for_each = { for m in var.members : m.edipi => m }

  realm_id       = var.realm
  username       = each.value.edipi
  email          = each.value.email
  first_name     = each.value.first_name
  last_name      = each.value.last_name
  enabled        = true
  email_verified = true

  # Mapped into the token by the DRP SSO client's `edipi` protocol mapper (chart/templates/uds-package.yaml) and resolved to a service_members row.
  attributes = {
    edipi = each.value.edipi
  }

  # Demo/test credential. Harmless under CAC/PIV (no password login); for username/password realms it lets testers sign in as any seeded member.
  initial_password {
    value     = var.default_password
    temporary = false
  }
}
