import React, { useState } from 'react';
import { Code2, Edit3, Play, Check } from 'lucide-react';
import './SqlCard.css';

const SqlCard = ({ sql, onExecute }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSql, setEditedSql] = useState(sql);

  return (
    <div className="sql-card">
      <div className="sql-card-header">
        <div className="sql-title">
          <Code2 size={18} />
          <span>Requête SQL</span>
        </div>

        <button
          type="button"
          className="btn-edit"
          onClick={() => setIsEditing((prev) => !prev)}
        >
          {isEditing ? <Check size={14} /> : <Edit3 size={14} />}
          <span>{isEditing ? 'Valider' : 'Éditer'}</span>
        </button>
      </div>

      <div className="sql-card-body">
        {isEditing ? (
          <textarea
            value={editedSql}
            onChange={(e) => setEditedSql(e.target.value)}
            className="sql-textarea"
          />
        ) : (
          <pre className="sql-code-block">
            <code>{editedSql}</code>
          </pre>
        )}
      </div>

      <div className="sql-card-footer">
        <button type="button" className="btn-execute" onClick={() => onExecute(editedSql)}>
          <Play size={15} />
          <span>Exécuter la requête</span>
        </button>
      </div>
    </div>
  );
};

export default SqlCard;