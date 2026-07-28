package com.example.security.dto;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@ToString
public class LoginResponse {
    private String accessToken;
    private String tokenType = "Bearer";
    private String username;
    private String role;

    public LoginResponse(String accessToken, String username, String role) {
        this.accessToken = accessToken;
        this.username = username;
        this.role = role;
    }
}
