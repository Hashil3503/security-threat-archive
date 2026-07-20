package com.example.security.service;

import com.example.security.entity.ThreatCategory;
import com.example.security.repository.ThreatCategoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ThreatCategoryService extends AbstractCrudService<ThreatCategory, Long> {

    public ThreatCategoryService(ThreatCategoryRepository repository) {
        super(repository);
    }

    @Override
    @Transactional
    public ThreatCategory update(Long id, ThreatCategory entity) {
        ThreatCategory category = findById(id);
        category.setName(entity.getName());
        category.setDescription(entity.getDescription());
        return category;
    }
}
