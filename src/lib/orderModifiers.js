export const meatPointOptions = ['Mal passada', 'Ao ponto', 'Bem passada']

export const removalOptions = [
  'Sem cebola',
  'Sem maionese',
  'Sem picles',
  'Sem bacon',
]

export const additionOptions = [
  { id: 'extra-bacon', label: 'Extra bacon', price: 5, inventoryItemId: 4, quantity: 35 },
  { id: 'extra-cheddar', label: 'Extra cheddar', price: 4, inventoryItemId: 3, quantity: 35 },
  { id: 'extra-hamburguer', label: 'Extra hamburguer', price: 8, inventoryItemId: 2, quantity: 1 },
  { id: 'extra-molho', label: 'Extra molho', price: 2, inventoryItemId: 8, quantity: 25 },
]

export const emptyModifiers = {
  meatPoint: '',
  removals: [],
  additions: [],
}

export function getSelectedOrderModifiers(modifiers = emptyModifiers) {
  return {
    meatPoint: modifiers.meatPoint,
    removals: removalOptions.filter((option) => modifiers.removals?.includes(option)),
    additions: additionOptions.filter((option) => modifiers.additions?.includes(option.id)),
  }
}

export function getModifiersUnitTotal(selectedModifiers) {
  return selectedModifiers.additions.reduce((total, addition) => total + addition.price, 0)
}

export function getOrderUnitPrice(product, selectedModifiers) {
  return (product?.price ?? 0) + getModifiersUnitTotal(selectedModifiers)
}

export function buildOrderNotes(selectedModifiers, manualNotes = '') {
  const notes = [
    selectedModifiers.meatPoint ? `Ponto: ${selectedModifiers.meatPoint}` : '',
    ...selectedModifiers.removals,
    ...selectedModifiers.additions.map((addition) => addition.label),
    manualNotes.trim(),
  ].filter(Boolean)

  return notes.join(' | ')
}

export function applyModifierStockConsumption(inventoryItems, selectedModifiers, quantity) {
  if (!selectedModifiers.additions.length) return inventoryItems

  return inventoryItems.map((item) => {
    const totalConsumption = selectedModifiers.additions
      .filter((addition) => addition.inventoryItemId === item.id)
      .reduce((total, addition) => total + addition.quantity * quantity, 0)

    if (!totalConsumption) return item

    return {
      ...item,
      currentStock: item.currentStock - totalConsumption,
    }
  })
}
