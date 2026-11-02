# The only door in and the only door out of one customer's NODE.
#   in : TCP 7770 -> the node container (what the host publishes on loopback)
#   out: an HTTP proxy that allows named hosts only (EDGE_ALLOW), nothing else
#
# UNTESTED: written without a Docker daemon available. See docs/CUSTOMER-NODE.md.
FROM alpine:3.20
RUN apk add --no-cache tinyproxy socat bash
COPY entrypoint.sh /usr/local/bin/edge-entrypoint
RUN chmod 0755 /usr/local/bin/edge-entrypoint
USER 65534:65534
EXPOSE 7770 8888
ENTRYPOINT ["/usr/local/bin/edge-entrypoint"]
