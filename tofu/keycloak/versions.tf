terraform {
  required_version = ">= 1.6"

  required_providers {
    keycloak = {
      # The community Keycloak provider (formerly mrparkers/keycloak). UDS Core's
      # "Manage Keycloak with OpenTofu" guide uses this same provider.
      source  = "keycloak/keycloak"
      version = ">= 4.4"
    }
  }
}
