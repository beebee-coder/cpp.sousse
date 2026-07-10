'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export default function ConfigurationPage() {
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [description, setDescription] = useState('');
  const [required, setRequired] = useState(false);

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      const res = await apiClient.get<{ success: boolean; items: any[] }>('/api/procedure-config-fields');
      setFields(Array.isArray(res.items) ? res.items : []);
    } catch (error) {
      console.error('[ConfigPage] Erreur chargement des champs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post<{ success: boolean }>('/api/procedure-config-fields', {
        name,
        type,
        description,
        required,
      });
      if (res.success !== false) {
        setName('');
        setDescription('');
        setRequired(false);
        await fetchFields();
      }
    } catch (error) {
      console.error('[ConfigPage] Erreur création du champ:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiClient.delete<{ success: boolean }>(`/api/procedure-config-fields/${id}`);
      if (res.success !== false) {
        await fetchFields();
      }
    } catch (error) {
      console.error('[ConfigPage] Erreur suppression du champ:', error);
    }
  };

  if (loading) return <div className="p-8">Chargement...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Configuration des Procédures</h1>
        <p className="text-gray-500">Gérez la bibliothèque d'attributs réutilisables pour les étapes de procédure.</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border">
        <h2 className="text-xl font-semibold mb-4">Ajouter un nouvel attribut</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nom</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="ex: Température"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="text">Texte</option>
                <option value="number">Nombre</option>
                <option value="boolean">Booléen</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description (Optionnel)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="required"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="required" className="text-sm font-medium">Requis</label>
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Créer l'attribut
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border">
        <h2 className="text-xl font-semibold mb-4">Attributs existants</h2>
        {fields.length === 0 ? (
          <p className="text-gray-500">Aucun attribut configuré pour le moment.</p>
        ) : (
          <div className="divide-y">
            {fields.map((field) => (
              <div key={field.id} className="py-4 flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-lg">{field.name}</h3>
                  <div className="text-sm text-gray-500 space-x-2">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">{field.type}</span>
                    {field.required && <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Requis</span>}
                  </div>
                  {field.description && <p className="text-sm mt-1">{field.description}</p>}
                </div>
                <button
                  onClick={() => handleDelete(field.id)}
                  className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
