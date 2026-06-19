variable "keycloak_url" {
  description = "Base Keycloak URL (no trailing slash), e.g. https://sso.uds.dev"
  type        = string
  default     = "https://keycloak.admin.uds.dev"
}

variable "realm" {
  description = "Keycloak realm the users are created in (and that hosts the OpenTofu client)."
  type        = string
  default     = "uds"
}

variable "client_id" {
  description = "Confidential client used for authentication. UDS Core ships uds-opentofu-client (realm-admin) for exactly this."
  type        = string
  default     = "uds-opentofu-client"
}

variable "client_secret" {
  description = "Secret for client_id. Do NOT commit — pass via TF_VAR_client_secret. Found in Keycloak: uds realm -> Clients -> uds-opentofu-client -> Credentials."
  type        = string
  sensitive   = true
}

variable "default_password" {
  description = <<-EOT
    Initial password set on every generated user, for demo/test login (CAC/PIV
    deployments would not use this). Override per environment. Must satisfy the
    realm PASSWORD_POLICY. Pass via TF_VAR_default_password to avoid committing it.
  EOT
  type        = string
  sensitive   = true
  default     = "WarHacker2026!*"
}

variable "members" {
  description = "Roster identities to provision. Generated from db/seed/seed.sql by generate_members.py into members.auto.tfvars.json — do not hand-edit."
  type = list(object({
    edipi      = string
    rank       = string
    first_name = string
    last_name  = string
    email      = string
  }))
}
