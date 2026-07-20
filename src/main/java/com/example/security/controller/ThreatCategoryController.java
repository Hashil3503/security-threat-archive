package com.example.security.controller;

import com.example.security.dto.ThreatCategoryDto;
import com.example.security.entity.ThreatCategory;
import com.example.security.service.ThreatCategoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/categories")
public class ThreatCategoryController {

    private final ThreatCategoryService categoryService;

    public ThreatCategoryController(ThreatCategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public ResponseEntity<List<ThreatCategoryDto>> getAllCategories() {
        List<ThreatCategoryDto> list = categoryService.findAll().stream()
                .map(ThreatCategoryDto::new)
                .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ThreatCategoryDto> getCategoryById(@PathVariable("id") Long id) {
        ThreatCategory category = categoryService.findById(id);
        return ResponseEntity.ok(new ThreatCategoryDto(category));
    }

    @PostMapping
    public ResponseEntity<ThreatCategoryDto> createCategory(@RequestBody ThreatCategoryDto dto) {
        ThreatCategory saved = categoryService.save(dto.toEntity());
        return ResponseEntity.ok(new ThreatCategoryDto(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ThreatCategoryDto> updateCategory(@PathVariable("id") Long id, @RequestBody ThreatCategoryDto dto) {
        ThreatCategory updated = categoryService.update(id, dto.toEntity());
        return ResponseEntity.ok(new ThreatCategoryDto(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable("id") Long id) {
        categoryService.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
