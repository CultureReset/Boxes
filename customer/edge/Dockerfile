# The only door in and the only door out of one customer's NODE.
#   in      : TCP 7770 -> the node container (what the host publishes on loopback)
#   gateway : TCP 8890, the only route to Paperclip, scoped to this customer's own company
#   proxy   : TCP 8888, CONNECT to the hosts in EDGE_ALLOW on port 443 and nothing else
#
# Plain Node, no packages. UNTESTED as an image: written without a Docker daemon available.
# The code itself is tested: npm run test:edge. See docs/CUSTOMER-NODE.md.
FROM node:22-alpine
WORKDIR /app
COPY policy.mjs issues.mjs edge.mjs ./
# The issue-id file lives on a named volume mounted here; the volume takes this ownership on first use.
RUN mkdir -p /state && chown 65534:65534 /state
USER 65534:65534
ENV EDGE_STATE_DIR=/state
EXPOSE 7770 8888 8890
CMD ["node", "/app/edge.mjs"]
