package com.example.security.service;

import java.util.List;

public interface CrudService<T, ID> {
    List<T> findAll();
    T findById(ID id);
    T save(T entity);
    T update(ID id, T entity);
    void deleteById(ID id);
}
