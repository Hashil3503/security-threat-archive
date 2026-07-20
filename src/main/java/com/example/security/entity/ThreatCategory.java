package com.example.security.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "threat_categories")
public class ThreatCategory extends BaseEntity {

    @Column(nullable = false, length = 50, unique = true)
    private String name;

    @Column(length = 255)
    private String description;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
