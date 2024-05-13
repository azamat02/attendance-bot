# Use an Alpine base image
FROM alpine:latest

# Install Node.js, npm, and yarn. Update ca-certificates.
RUN apk add --update nodejs npm yarn ca-certificates && \
    update-ca-certificates

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and yarn.lock files to the container
COPY package.json yarn.lock ./

# Install dependencies using Yarn
RUN yarn install --frozen-lockfile

# Copy the rest of your application code to the container
COPY . .

# Expose the port your app runs on
EXPOSE 5000

# Define the command to run your app
CMD ["yarn", "start"]
