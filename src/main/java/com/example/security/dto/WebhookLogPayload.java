package com.example.security.dto;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@ToString
public class WebhookLogPayload {
    private String categoryName;
    private String threatName;
    private String severityLevel;
    private String description;
    private String sourceIp;
    private String destinationIp;
    private Integer port;
    private String status;
}
