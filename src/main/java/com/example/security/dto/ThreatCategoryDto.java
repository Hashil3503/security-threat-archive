package com.example.security.dto;

import com.example.security.entity.ThreatCategory;

public class ThreatCategoryDto {
    private Long id;
    private String name;
    private String description;

    public ThreatCategoryDto() {}

    public ThreatCategoryDto(ThreatCategory category) {
        this.id = category.getId();
        this.name = category.getName();
        this.description = category.getDescription();
    }

    public ThreatCategory toEntity() {
        ThreatCategory category = new ThreatCategory();
        category.setId(this.id);
        category.setName(this.name);
        category.setDescription(this.description);
        return category;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
