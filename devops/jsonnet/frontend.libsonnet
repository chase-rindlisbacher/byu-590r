local k = import 'lib/k.libsonnet';

// Student-optimized AWS EKS Configuration for Angular Frontend
local namespace = 'byu-590r';
local appName = 'frontend';
local image = 'your-account.dkr.ecr.us-east-1.amazonaws.com/byu-590r-frontend:latest';
local port = 80;

// Environment variables
local envVars = [
  { name: 'API_URL', valueFrom: { secretKeyRef: { name: 'aws-secrets', key: 'API_URL' } } },
  { name: 'ENVIRONMENT', value: 'production' },
];

// Nginx configuration for Angular SPA
local nginxConfig = |||
  server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Handle Angular routing
    location / {
      try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
      expires 1y;
      add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
      access_log off;
      return 200 "healthy\n";
      add_header Content-Type text/plain;
    }
  }
|||;

// Frontend deployment - optimized for minimal costs
local frontendDeployment = k.deployment(
  appName,
  image,
  port,
  envVars
) + {
  metadata+: {
    namespace: namespace,
  },
  spec+: {
    replicas: 1,  // Single replica to minimize costs
    template+: {
      spec+: {
        containers: [
          k.apps.v1.deployment.mixin.spec.template.spec.container.new(appName, image) + {
            ports: [
              k.apps.v1.deployment.mixin.spec.template.spec.container.port.new(port),
            ],
            env: envVars,
            resources: {
              requests: {
                cpu: '50m',       // Minimal CPU request
                memory: '64Mi',   // Minimal memory request
              },
              limits: {
                cpu: '200m',      // Reduced CPU limit
                memory: '128Mi',  // Reduced memory limit
              },
            },
            livenessProbe: {
              httpGet: {
                path: '/health',
                port: port,
              },
              initialDelaySeconds: 10,
              periodSeconds: 30,  // Less frequent checks
            },
            readinessProbe: {
              httpGet: {
                path: '/health',
                port: port,
              },
              initialDelaySeconds: 5,
              periodSeconds: 10,
            },
            volumeMounts: [
              {
                name: 'nginx-config',
                mountPath: '/etc/nginx/conf.d/default.conf',
                subPath: 'default.conf',
              },
            ],
          },
        ],
        volumes: [
          {
            name: 'nginx-config',
            configMap: {
              name: 'frontend-nginx-config',
            },
          },
        ],
      },
    },
  },
};

// Service
local frontendService = k.service(appName, port, port, 'ClusterIP') + {
  metadata+: {
    namespace: namespace,
  },
};

// ConfigMap for Nginx configuration
local nginxConfigMap = k.configMap('frontend-nginx-config', {
  'default.conf': nginxConfig,
}) + {
  metadata+: {
    namespace: namespace,
  },
};

// NodePort services for direct access (no load balancer needed)
local frontendNodePort = k.service(appName + '-nodeport', 80, 80, 'NodePort') + {
  metadata+: {
    namespace: namespace,
  },
  spec+: {
    ports: [
      {
        name: 'http',
        port: 80,
        targetPort: 80,
        nodePort: 30080,  // Frontend accessible on port 30080
      },
    ],
  },
};

local backendNodePort = k.service('backend-nodeport', 8000, 8000, 'NodePort') + {
  metadata+: {
    namespace: namespace,
  },
  spec+: {
    ports: [
      {
        name: 'http',
        port: 8000,
        targetPort: 8000,
        nodePort: 30081,  // Backend accessible on port 30081
      },
    ],
  },
};

{
  // Export resources
  namespace: k.namespace(namespace),
  deployment: frontendDeployment,
  service: frontendService,
  configMap: nginxConfigMap,
  frontendNodePort: frontendNodePort,
  backendNodePort: backendNodePort,
}
