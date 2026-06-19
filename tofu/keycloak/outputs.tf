output "provisioned_user_count" {
  description = "Number of Keycloak users managed by this configuration."
  value       = length(keycloak_user.member)
}

output "usernames" {
  description = "Provisioned usernames (EDIPIs). Log in with these + default_password."
  value       = sort([for u in keycloak_user.member : u.username])
}
