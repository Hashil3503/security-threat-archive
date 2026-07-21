export interface ThreatCategory {
    id: number;
    name: string;
    description?: string;
}

export interface ThreatLog {
    id: number;
    categoryId: number;
    categoryName: string;
    threatName: string;
    severityLevel: string;
    description?: string;
    sourceIp?: string;
    destinationIp?: string;
    port?: number | null;
    status: string;
    abuseScore?: number | null;
    aiRecommendation?: string;
    loggedAt?: string;
    updatedAt?: string;
}

export interface ToastMessage {
    id: string;
    message: string;
    type: 'low' | 'danger' | 'high' | 'medium';
    title?: string;
    threatName?: string;
    ipInfo?: string;
}
