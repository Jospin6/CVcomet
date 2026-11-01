/** An explicit, versioned career taxonomy; no live vacancies, salaries or predictions. */
export const roleCatalog = [
  { id: "software-engineer", title: "Software Engineer", skills: ["typescript", "javascript", "react", "node", "git", "sql"] },
  { id: "senior-software-engineer", title: "Senior Software Engineer", skills: ["typescript", "architecture", "testing", "mentoring", "git", "sql"] },
  { id: "backend-engineer", title: "Backend Engineer", skills: ["node", "python", "sql", "api", "postgresql", "testing"] },
  { id: "solutions-architect", title: "Solutions Architect", skills: ["architecture", "cloud", "api", "security", "communication", "design"] },
  { id: "engineering-manager", title: "Engineering Manager", skills: ["leadership", "mentoring", "architecture", "planning", "communication", "agile"] },
  { id: "technical-product-manager", title: "Technical Product Manager", skills: ["product", "roadmap", "analytics", "communication", "agile", "technical"] },
  { id: "product-manager", title: "Product Manager", skills: ["product", "roadmap", "analytics", "research", "communication", "agile"] },
  { id: "ai-engineer", title: "AI Engineer", skills: ["python", "llm", "rag", "api", "machine learning", "cloud"] },
  { id: "machine-learning-engineer", title: "Machine Learning Engineer", skills: ["python", "machine learning", "pytorch", "deployment", "cloud", "statistics"] },
  { id: "ai-solutions-architect", title: "AI Solutions Architect", skills: ["ai", "architecture", "llm", "cloud", "security", "api"] },
  { id: "ai-product-manager", title: "AI Product Manager", skills: ["product", "ai", "roadmap", "analytics", "research", "communication"] },
  { id: "data-analyst", title: "Data Analyst", skills: ["sql", "excel", "analytics", "python", "visualization", "statistics"] },
  { id: "data-scientist", title: "Data Scientist", skills: ["python", "sql", "statistics", "machine learning", "visualization", "analytics"] },
  { id: "business-analyst", title: "Business Analyst", skills: ["analytics", "sql", "requirements", "communication", "process", "excel"] },
  { id: "devops-engineer", title: "DevOps Engineer", skills: ["docker", "kubernetes", "cloud", "ci/cd", "monitoring", "linux"] },
  { id: "security-engineer", title: "Security Engineer", skills: ["security", "cloud", "network", "monitoring", "testing", "linux"] },
  { id: "ux-designer", title: "UX Designer", skills: ["figma", "research", "prototyping", "design", "communication", "accessibility"] },
  { id: "product-designer", title: "Product Designer", skills: ["figma", "design", "research", "prototyping", "product", "accessibility"] },
  { id: "technical-founder", title: "Technical Founder", skills: ["product", "leadership", "business", "development", "finance", "communication"] },
  { id: "technology-director", title: "Technology Director", skills: ["architecture", "leadership", "security", "planning", "cloud", "management"] },
] as const;
export type CareerRole = (typeof roleCatalog)[number];
export function careerRoleById(id: string) {
  return roleCatalog.find(role => role.id === id);
}
