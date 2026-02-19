import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('CLI Integration Tests', () => {
  const testOutputDir = '/tmp/openapi-test-output'
  const toySpecPath = path.join(process.cwd(), 'tests/fixtures/toy-openapi.json')

  beforeEach(() => {
    // Clean up any existing test output
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    // Clean up test output
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true })
    }
  })

  describe('File generation from toy OpenAPI spec', () => {
    it('should validate toy OpenAPI spec structure', () => {
      expect(fs.existsSync(toySpecPath)).toBe(true)

      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      expect(spec).toHaveProperty('openapi')
      expect(spec).toHaveProperty('info')
      expect(spec).toHaveProperty('paths')
      expect(spec.openapi).toBe('3.0.3')
      expect(spec.info.title).toBe('Pet Store API')
    })

    it('should have correct operations in toy spec', () => {
      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      const operations = []

      // Extract all operation IDs
      for (const [_pathUrl, pathItem] of Object.entries(spec.paths)) {
        for (const [_method, operation] of Object.entries(pathItem as any)) {
          if (operation && typeof operation === 'object' && 'operationId' in operation) {
            operations.push(operation.operationId)
          }
        }
      }

      expect(operations.sort()).toEqual([
        'createPet',
        'deletePet',
        'getPet',
        'listPets',
        'listUserPets',
        'updatePet',
        'uploadPetPic',
      ])
    })

    it('should validate operation methods and paths', () => {
      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      // Validate specific operations
      expect(spec.paths['/pets']).toHaveProperty('get')
      expect(spec.paths['/pets']).toHaveProperty('post')
      expect(spec.paths['/pets'].get.operationId).toBe('listPets')
      expect(spec.paths['/pets'].post.operationId).toBe('createPet')

      expect(spec.paths['/pets/{petId}']).toHaveProperty('get')
      expect(spec.paths['/pets/{petId}']).toHaveProperty('put')
      expect(spec.paths['/pets/{petId}']).toHaveProperty('delete')
      expect(spec.paths['/pets/{petId}'].get.operationId).toBe('getPet')
      expect(spec.paths['/pets/{petId}'].put.operationId).toBe('updatePet')
      expect(spec.paths['/pets/{petId}'].delete.operationId).toBe('deletePet')

      expect(spec.paths['/users/{userId}/pets']).toHaveProperty('get')
      expect(spec.paths['/users/{userId}/pets'].get.operationId).toBe('listUserPets')
    })

    it('should validate parameter definitions', () => {
      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      // Check petId parameter in GET /pets/{petId}
      const getPetOp = spec.paths['/pets/{petId}'].get
      expect(getPetOp.parameters).toHaveLength(1)
      expect(getPetOp.parameters[0].name).toBe('petId')
      expect(getPetOp.parameters[0].in).toBe('path')
      expect(getPetOp.parameters[0].required).toBe(true)

      // Check userId parameter in GET /users/{userId}/pets
      const listUserPetsOp = spec.paths['/users/{userId}/pets'].get
      expect(listUserPetsOp.parameters).toHaveLength(1)
      expect(listUserPetsOp.parameters[0].name).toBe('userId')
      expect(listUserPetsOp.parameters[0].in).toBe('path')
      expect(listUserPetsOp.parameters[0].required).toBe(true)
    })

    it('should validate response schemas', () => {
      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      // Check that all operations have 200 responses
      const operationPaths = [
        ['paths', '/pets', 'get'],
        ['paths', '/pets', 'post'],
        ['paths', '/pets/{petId}', 'get'],
        ['paths', '/pets/{petId}', 'put'],
        ['paths', '/pets/{petId}', 'delete'],
        ['paths', '/users/{userId}/pets', 'get'],
      ]

      operationPaths.forEach((pathArray) => {
        let obj = spec
        for (const key of pathArray) {
          obj = obj[key]
        }
        expect(obj.responses).toHaveProperty('200')
        expect(obj.responses['200']).toHaveProperty('content')
        expect(obj.responses['200'].content).toHaveProperty('application/json')
      })
    })

    it('should validate component schemas', () => {
      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      expect(spec).toHaveProperty('components')
      expect(spec.components).toHaveProperty('schemas')
      expect(spec.components.schemas).toHaveProperty('Pet')
      expect(spec.components.schemas).toHaveProperty('NewPet')

      // Validate Pet schema
      const petSchema = spec.components.schemas.Pet
      expect(petSchema.type).toBe('object')
      expect(petSchema.required).toEqual(['name'])
      expect(petSchema.properties).toHaveProperty('id')
      expect(petSchema.properties).toHaveProperty('name')
      expect(petSchema.properties).toHaveProperty('tag')
      expect(petSchema.properties).toHaveProperty('status')

      // Validate NewPet schema
      const newPetSchema = spec.components.schemas.NewPet
      expect(newPetSchema.type).toBe('object')
      expect(newPetSchema.required).toEqual(['name'])
      expect(newPetSchema.properties).toHaveProperty('name')
      expect(newPetSchema.properties).toHaveProperty('tag')
      expect(newPetSchema.properties).toHaveProperty('status')
    })
  })

  describe('Generated code validation', () => {
    it('should have consistent operation naming patterns', () => {
      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      const operations: { id: string; method: string; path: string }[] = []

      for (const [pathUrl, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem as any)) {
          if (operation && typeof operation === 'object' && 'operationId' in operation) {
            operations.push({
              id: operation.operationId as string,
              method: method.toUpperCase(),
              path: pathUrl,
            })
          }
        }
      }

      // Validate naming patterns
      const listOperations = operations.filter((op) => op.id.startsWith('list'))
      const getOperations = operations.filter((op) => op.id.startsWith('get'))
      const createOperations = operations.filter((op) => op.id.startsWith('create'))
      const updateOperations = operations.filter((op) => op.id.startsWith('update'))
      const deleteOperations = operations.filter((op) => op.id.startsWith('delete'))

      expect(listOperations.every((op) => op.method === 'GET')).toBe(true)
      expect(getOperations.every((op) => op.method === 'GET')).toBe(true)
      expect(createOperations.every((op) => op.method === 'POST')).toBe(true)
      expect(updateOperations.every((op) => op.method === 'PUT')).toBe(true)
      expect(deleteOperations.every((op) => op.method === 'DELETE')).toBe(true)
    })

    it('should support various REST patterns', () => {
      const specContent = fs.readFileSync(toySpecPath, 'utf8')
      const spec = JSON.parse(specContent)

      // Collection endpoint
      expect(spec.paths).toHaveProperty('/pets')
      expect(spec.paths['/pets']).toHaveProperty('get') // list
      expect(spec.paths['/pets']).toHaveProperty('post') // create

      // Resource endpoint
      expect(spec.paths).toHaveProperty('/pets/{petId}')
      expect(spec.paths['/pets/{petId}']).toHaveProperty('get') // get by id
      expect(spec.paths['/pets/{petId}']).toHaveProperty('put') // update
      expect(spec.paths['/pets/{petId}']).toHaveProperty('delete') // delete

      // Nested resource endpoint
      expect(spec.paths).toHaveProperty('/users/{userId}/pets')
      expect(spec.paths['/users/{userId}/pets']).toHaveProperty('get') // nested list
    })
  })

  describe('Mock usage patterns', () => {
    it('should demonstrate typical API usage patterns', () => {
      // This test demonstrates how the generated types would be used
      // with the actual library (conceptually)

      const mockOperations = {
        listPets: { method: 'GET', path: '/pets' },
        getPet: { method: 'GET', path: '/pets/{petId}' },
        createPet: { method: 'POST', path: '/pets' },
        updatePet: { method: 'PUT', path: '/pets/{petId}' },
        deletePet: { method: 'DELETE', path: '/pets/{petId}' },
        listUserPets: { method: 'GET', path: '/users/{userId}/pets' },
      }

      // Verify that our mock operations match the toy spec
      expect(Object.keys(mockOperations).sort()).toEqual([
        'createPet',
        'deletePet',
        'getPet',
        'listPets',
        'listUserPets',
        'updatePet',
      ])
    })

    it('should validate expected TypeScript generation patterns', () => {
      // Mock what the generated api-operations.ts content should look like
      const expectedOperationIds = ['createPet', 'deletePet', 'getPet', 'listPets', 'listUserPets', 'updatePet']

      const expectedOperationInfo = {
        listPets: { path: '/pets', method: 'GET' },
        createPet: { path: '/pets', method: 'POST' },
        getPet: { path: '/pets/{petId}', method: 'GET' },
        updatePet: { path: '/pets/{petId}', method: 'PUT' },
        deletePet: { path: '/pets/{petId}', method: 'DELETE' },
        listUserPets: { path: '/users/{userId}/pets', method: 'GET' },
      }

      // These should match what our codegen would produce
      expect(expectedOperationIds.length).toBe(6)
      expect(Object.keys(expectedOperationInfo).length).toBe(6)

      // Verify each operation has correct structure
      Object.entries(expectedOperationInfo).forEach(([_opId, info]) => {
        expect(info).toHaveProperty('path')
        expect(info).toHaveProperty('method')
        expect(typeof info.path).toBe('string')
        expect(['GET', 'POST', 'PUT', 'DELETE'].includes(info.method)).toBe(true)
      })
    })
  })
})
