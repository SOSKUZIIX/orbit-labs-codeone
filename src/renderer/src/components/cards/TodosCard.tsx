import type { UICard } from '@shared/types'

type TodosCardData = Extract<UICard, { type: 'todos' }>

interface Props {
  card: TodosCardData
}

export function TodosCard({ card }: Props): JSX.Element {
  const total = card.items.length
  const done = card.items.filter((i) => i.done).length
  return (
    <div className="card todos-card">
      <div className="card-title">
        Agent tasks{' '}
        <span className="todos-count">
          {done}/{total}
        </span>
      </div>
      <ul className="todos-list">
        {card.items.map((it) => (
          <li
            key={it.id}
            className={'todo-item' + (it.done ? ' done' : '')}
          >
            <span className="todo-check" aria-hidden="true">
              {it.done ? '✓' : ''}
            </span>
            <span className="todo-text">{it.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
