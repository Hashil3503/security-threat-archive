package com.example.security.dto;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import com.example.security.entity.ThreatCategory;

@Getter
@Setter
@ToString
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
}
