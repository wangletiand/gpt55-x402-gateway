FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json server.mjs smoke.mjs server.json README.md LICENSE ./

EXPOSE 3000
USER node
CMD ["npm", "start"]
