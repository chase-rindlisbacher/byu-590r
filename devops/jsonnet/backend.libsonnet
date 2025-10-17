local k = import 'lib/k.libsonnet';

// Student-optimized AWS EKS Configuration for Laravel Backend
local namespace = 'byu-590r';
local appName = 'backend';
local image = 'your-account.dkr.ecr.us-east-1.amazonaws.com/byu-590r-backend:latest';
local port = 8000;

// Environment variables from AWS Secrets Manager
local envVars = [
  { name: 'APP_ENV', value: 'production' },
  { name: 'APP_DEBUG', value: 'false' },
  { name: 'APP_URL', valueFrom: { secretKeyRef: { name: 'aws-secrets', key: 'APP_URL' } } },
  { name: 'LOG_CHANNEL', value: 'stderr' },
  { name: 'DB_CONNECTION', value: 'mysql' },
  { name: 'DB_HOST', valueFrom: { secretKeyRef: { name: 'aws-secrets', key: 'DB_HOST' } } },
  { name: 'DB_PORT', value: '3306' },
  { name: 'DB_DATABASE', valueFrom: { secretKeyRef: { name: 'aws-secrets', key: 'DB_DATABASE' } } },
  { name: 'DB_USERNAME', valueFrom: { secretKeyRef: { name: 'aws-secrets', key: 'DB_USERNAME' } } },
  { name: 'DB_PASSWORD', valueFrom: { secretKeyRef: { name: 'aws-secrets', key: 'DB_PASSWORD' } } },
  { name: 'CACHE_DRIVER', value: 'file' },
  { name: 'SESSION_DRIVER', value: 'file' },
  { name: 'QUEUE_CONNECTION', value: 'sync' },
  { name: 'AWS_REGION', value: 'us-east-1' },
  { name: 'AWS_ACCESS_KEY_ID', valueFrom: { secretKeyRef: { name: 'aws-secrets', key: 'AWS_ACCESS_KEY_ID' } } },
  { name: 'AWS_SECRET_ACCESS_KEY', valueFrom: { secretKeyRef: { name: 'aws-secrets', key: 'AWS_SECRET_ACCESS_KEY' } } },
];

// Laravel backend deployment - optimized for minimal costs
local backendDeployment = k.deployment(
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
                cpu: '100m',      // Minimal CPU request
                memory: '128Mi',  // Minimal memory request
              },
              limits: {
                cpu: '500m',      // Reduced CPU limit
                memory: '512Mi',  // Reduced memory limit
              },
            },
            livenessProbe: {
              httpGet: {
                path: '/api/health',
                port: port,
              },
              initialDelaySeconds: 30,
              periodSeconds: 30,  // Less frequent checks
            },
            readinessProbe: {
              httpGet: {
                path: '/api/health',
                port: port,
              },
              initialDelaySeconds: 10,
              periodSeconds: 10,
            },
            command: ['php', 'artisan', 'serve', '--host=0.0.0.0', '--port=8000'],
          },
        ],
        initContainers: [
          {
            name: 'migrate',
            image: image,
            env: envVars,
            command: ['php', 'artisan', 'migrate', '--force'],
            resources: {
              requests: {
                cpu: '100m',
                memory: '128Mi',
              },
              limits: {
                cpu: '500m',
                memory: '512Mi',
              },
            },
          },
        ],
      },
    },
  },
};

// Service
local backendService = k.service(appName, port, port, 'ClusterIP') + {
  metadata+: {
    namespace: namespace,
  },
};

// Remove HPA for cost optimization - no auto-scaling
// Students can manually scale if needed

{
  // Export resources
  namespace: k.namespace(namespace),
  deployment: backendDeployment,
  service: backendService,
}
