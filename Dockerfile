FROM nginx:alpine

# Serve the game as a static site
COPY index.html /usr/share/nginx/html/index.html
COPY flowerman_track.mp3 /usr/share/nginx/html/flowerman_track.mp3

# Optional: basic nginx config for SPA-style fallback
RUN printf 'server {\n  listen 80;\n  server_name _;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n  # Allow large embedded audio pages if you switch to the full build\n  client_max_body_size 20m;\n}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
