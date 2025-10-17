// Kubernetes library for BYU 590R Monorepo
// Provides common Kubernetes resource templates

local k = import 'ksonnet.beta.4/k8s.libsonnet';

// Common labels for all resources
local commonLabels = {
  app: 'byu-590r-monorepo',
  version: '1.0.0',
  managed-by: 'jsonnet',
};

// Namespace configuration
local namespace(name) = k.core.v1.namespace.new(name) + {
  metadata+: {
    labels+: commonLabels,
  },
};

// ConfigMap template
local configMap(name, data) = k.core.v1.configMap.new(name) + {
  metadata+: {
    labels+: commonLabels,
  },
  data: data,
};

// Secret template
local secret(name, data) = k.core.v1.secret.new(name) + {
  metadata+: {
    labels+: commonLabels,
  },
  type: 'Opaque',
  data: data,
};

// Service template
local service(name, port, targetPort, serviceType='ClusterIP') = k.core.v1.service.new(name, port, targetPort) + {
  metadata+: {
    labels+: commonLabels,
  },
  spec+: {
    type: serviceType,
    selector+: commonLabels,
  },
};

// Deployment template
local deployment(name, image, port, env=[], volumes=[], volumeMounts=[]) = k.apps.v1.deployment.new(name, 1) + {
  metadata+: {
    labels+: commonLabels,
  },
  spec+: {
    selector+: {
      matchLabels+: commonLabels,
    },
    template+: {
      metadata+: {
        labels+: commonLabels,
      },
      spec+: {
        containers: [
          k.apps.v1.deployment.mixin.spec.template.spec.container.new(name, image) + {
            ports: [
              k.apps.v1.deployment.mixin.spec.template.spec.container.port.new(port),
            ],
            env: env,
            volumeMounts: volumeMounts,
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
        volumes: volumes,
      },
    },
  },
};

// Ingress template
local ingress(name, host, serviceName, servicePort, tlsSecret=null) = k.networking.v1.ingress.new() + {
  metadata+: {
    name: name,
    labels+: commonLabels,
    annotations: {
      'kubernetes.io/ingress.class': 'nginx',
      'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
    },
  },
  spec+: {
    rules: [
      {
        host: host,
        http: {
          paths: [
            {
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: serviceName,
                  port: {
                    number: servicePort,
                  },
                },
              },
            },
          ],
        },
      },
    ],
  },
} + if tlsSecret != null then {
  spec+: {
    tls: [
      {
        hosts: [host],
        secretName: tlsSecret,
      },
    ],
  },
} else {};

// PersistentVolumeClaim template
local pvc(name, size, storageClass='standard') = k.core.v1.persistentVolumeClaim.new(name) + {
  metadata+: {
    labels+: commonLabels,
  },
  spec+: {
    accessModes: ['ReadWriteOnce'],
    resources: {
      requests: {
        storage: size,
      },
    },
    storageClassName: storageClass,
  },
};

// Job template
local job(name, image, command, args=[], env=[]) = k.batch.v1.job.new(name) + {
  metadata+: {
    labels+: commonLabels,
  },
  spec+: {
    template+: {
      metadata+: {
        labels+: commonLabels,
      },
      spec+: {
        containers: [
          k.batch.v1.job.mixin.spec.template.spec.container.new(name, image) + {
            command: command,
            args: args,
            env: env,
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
        restartPolicy: 'Never',
      },
    },
    backoffLimit: 3,
  },
};

// CronJob template
local cronJob(name, schedule, image, command, args=[], env=[]) = k.batch.v1.cronJob.new(name, schedule) + {
  metadata+: {
    labels+: commonLabels,
  },
  spec+: {
    jobTemplate+: {
      spec+: {
        template+: {
          metadata+: {
            labels+: commonLabels,
          },
          spec+: {
            containers: [
              k.batch.v1.cronJob.mixin.spec.jobTemplate.spec.template.spec.container.new(name, image) + {
                command: command,
                args: args,
                env: env,
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
            restartPolicy: 'OnFailure',
          },
        },
      },
    },
  },
};

{
  // Export all templates
  namespace: namespace,
  configMap: configMap,
  secret: secret,
  service: service,
  deployment: deployment,
  ingress: ingress,
  pvc: pvc,
  job: job,
  cronJob: cronJob,
  
  // Common labels for reuse
  labels: commonLabels,
}
