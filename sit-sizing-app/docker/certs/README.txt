Corporate root CA certificates for container builds (PEM, *.pem or *.crt).
Git-ignored. Trusted by Node in every image stage via NODE_EXTRA_CA_CERTS.
macOS: `pnpm dev:env` exports the System keychain here automatically.
Manual: security find-certificate -a -p /Library/Keychains/System.keychain > docker/certs/corp.pem
Windows/Linux: ask the service desk for the organisation's root CA in PEM format.
