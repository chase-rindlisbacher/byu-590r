local backend = import 'backend.libsonnet';
local frontend = import 'frontend.libsonnet';

// AWS Secrets Manager Secret Store CSI Driver
local awsSecretsStore = {
  apiVersion: 'secrets-store.csi.x-k8s.io/v1',
  kind: 'SecretProviderClass',
  metadata+: {
    name: 'aws-secrets-provider',
    namespace: 'byu-590r',
  },
  spec: {
    provider: 'aws',
    parameters: {
      objects: |||
        - objectName: "byu-590r-secrets"
          objectType: "secretsmanager"
      |||,
      region: 'us-east-1',
    },
    secretObjects: [
      {
        secretName: 'aws-secrets',
        type: 'Opaque',
        data: [
          {
            objectName: 'byu-590r-secrets',
            key: 'DB_HOST',
          },
          {
            objectName: 'byu-590r-secrets',
            key: 'DB_DATABASE',
          },
          {
            objectName: 'byu-590r-secrets',
            key: 'DB_USERNAME',
          },
          {
            objectName: 'byu-590r-secrets',
            key: 'DB_PASSWORD',
          },
          {
            objectName: 'byu-590r-secrets',
            key: 'AWS_ACCESS_KEY_ID',
          },
          {
            objectName: 'byu-590r-secrets',
            key: 'AWS_SECRET_ACCESS_KEY',
          },
          {
            objectName: 'byu-590r-secrets',
            key: 'APP_URL',
          },
          {
            objectName: 'byu-590r-secrets',
            key: 'API_URL',
          },
        ],
      },
    ],
  },
};

// IAM Role for Service Account (IRSA)
local backendServiceAccount = {
  apiVersion: 'v1',
  kind: 'ServiceAccount',
  metadata+: {
    name: 'backend-service-account',
    namespace: 'byu-590r',
    annotations: {
      'eks.amazonaws.com/role-arn': 'arn:aws:iam::your-account-id:role/backend-irsa-role',
    },
  },
};

// Update backend deployment to use service account
local backendDeploymentWithSA = backend.deployment + {
  spec+: {
    template+: {
      spec+: {
        serviceAccountName: 'backend-service-account',
        volumes: [
          {
            name: 'secrets-store-inline',
            csi: {
              driver: 'secrets-store.csi.k8s.io',
              readOnly: true,
              volumeAttributes: {
                secretProviderClass: 'aws-secrets-provider',
              },
            },
          },
        ],
        containers: [
          backend.deployment.spec.template.spec.containers[0] + {
            volumeMounts: [
              {
                name: 'secrets-store-inline',
                mountPath: '/mnt/secrets-store',
                readOnly: true,
              },
            ],
          },
        ],
      },
    },
  },
};

{
  // Export all resources
  namespace: backend.namespace,
  
  // Backend resources
  backend_deployment: backendDeploymentWithSA,
  backend_service: backend.service,
  backend_service_account: backendServiceAccount,
  
  // Frontend resources
  frontend_deployment: frontend.deployment,
  frontend_service: frontend.service,
  frontend_configmap: frontend.configMap,
  
  // NodePort services for direct access
  frontend_nodeport: frontend.frontendNodePort,
  backend_nodeport: frontend.backendNodePort,
  
  // AWS-specific resources
  aws_secrets_provider: awsSecretsStore,
}