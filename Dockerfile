FROM node:18-alpine AS build
WORKDIR /usr/src/morsewalker
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Use a lightweight server to serve the built files
FROM nginx:alpine
# Copy the build files from the previous stage
COPY --from=build /usr/src/morsewalker/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

