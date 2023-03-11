FROM node:alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY *.js ./
EXPOSE 8080
CMD ["npm", "start"]