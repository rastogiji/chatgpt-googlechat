FROM node:alpine

COPY index.js package.json credentials.json .env /
RUN npm install
CMD ["npm", "start"]