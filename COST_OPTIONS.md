# Kubernetes Cost Options for Students

Here are different approaches to get Kubernetes under $30/month, ranked by cost:

## 🏆 Option 1: Self-Managed Kubernetes on EC2 (Recommended)

**Cost: ~$10-15/month**

### Setup:

```bash
# Single EC2 instance with Kubernetes
# t3.medium instance: ~$30/month
# With free tier (first year): ~$10-15/month

# Create EC2 instance
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.medium \
  --key-name your-key \
  --security-groups your-sg

# Install Kubernetes manually
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install kubeadm, kubelet, kubectl
# Follow: https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/
```

### Pros:

- ✅ Learn real Kubernetes installation
- ✅ Full control over the cluster
- ✅ Under $15/month with free tier
- ✅ Same Jsonnet configs work

### Cons:

- ❌ Manual setup required
- ❌ No managed control plane

---

## 🥈 Option 2: EKS Fargate (Serverless)

**Cost: ~$25-30/month**

### Setup:

```bash
# EKS with Fargate (no EC2 nodes)
eksctl create cluster \
  --name byu-590r-fargate \
  --region us-east-1 \
  --fargate

# Pay only for running pods
# ~$0.04/vCPU/hour + ~$0.004/GB/hour
```

### Pros:

- ✅ No node management
- ✅ Pay only when running
- ✅ Managed control plane
- ✅ Same Jsonnet configs work

### Cons:

- ❌ More expensive than self-managed
- ❌ Cold start delays

---

## 🥉 Option 3: Local Kubernetes (Free)

**Cost: $0/month**

### Setup:

```bash
# Option A: minikube
minikube start --driver=docker

# Option B: kind (Kubernetes in Docker)
kind create cluster --name byu-590r

# Option C: k3s
curl -sfL https://get.k3s.io | sh -
```

### Pros:

- ✅ Completely free
- ✅ Fast development
- ✅ Same Jsonnet configs work

### Cons:

- ❌ Not accessible from outside
- ❌ No cloud learning
- ❌ Limited to single machine

---

## 🚀 Option 4: MicroK8s on Ubuntu (Hybrid)

**Cost: ~$8-12/month**

### Setup:

```bash
# Single EC2 instance with MicroK8s
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.small \
  --key-name your-key

# Install MicroK8s
sudo snap install microk8s --classic
sudo microk8s enable dns storage ingress

# Access from anywhere
sudo microk8s kubectl port-forward service/frontend 30080:80
```

### Pros:

- ✅ Lightweight Kubernetes
- ✅ Easy setup
- ✅ Under $12/month
- ✅ Real cloud deployment

### Cons:

- ❌ Single node only
- ❌ Less "production-like"

---

## 🎯 Recommended: Option 1 (Self-Managed EC2)

For student learning, I recommend **Option 1** because:

1. **Cost**: ~$10-15/month with free tier
2. **Learning**: Students learn real Kubernetes installation
3. **Skills**: Valuable DevOps skills (kubeadm, cluster setup)
4. **Flexibility**: Can scale up later if needed
5. **Real-world**: Many companies use self-managed K8s

### Updated Architecture:

```
┌─────────────────┐    ┌──────────────────┐
│   Student       │    │   EC2 Instance   │
│   Browser       │───▶│  + Elastic IP    │
└─────────────────┘    │  + Kubernetes    │
                       └──────────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
            ┌───────▼──┐ ┌──────▼──────┐ ┌─▼─────────┐
            │Frontend  │ │  Backend    │ │ Database  │
            │:30080    │ │  :30081     │ │   RDS     │
            └──────────┘ └─────────────┘ └───────────┘
```

### Cost Breakdown:

- **EC2 t3.medium**: $30/month → **$10-15/month** (with free tier)
- **RDS db.t3.micro**: $15/month → **$0** (with free tier)
- **Elastic IP**: $3.65/month
- **ECR**: $1/month
- **Total**: ~$15-20/month → **With free tier: ~$5-8/month**

This is perfect for student learning while staying under $30/month!
