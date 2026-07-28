package com.example.security.entity;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import jakarta.persistence.*;

@Entity
@Table(name = "threat_categories")
@Getter
@Setter
@ToString
public class ThreatCategory extends BaseEntity {

    @Column(nullable = false, length = 50, unique = true)
    private String name;

    @Column(length = 255)
    private String description;
}
