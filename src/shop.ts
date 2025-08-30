const basePrices: Record<string, number> = { pla: 0.055, pbse: 0.145, abs: 0.295 };
const deliveryPrices: Record<string, number> = { standard: 0, fast: 2, express: 3.50 };

const shippingLocationPrices: Record<string, number> = {
  Barrow: 0,
  Roose: 1.5,
  Askam: 4,
  Dalton: 4.6,
  Ulverston: 6
};
const collectionInput = document.getElementById('collection') as HTMLInputElement;
const form = document.getElementById('shopForm') as HTMLFormElement;
const totalCostSpan = document.getElementById('totalCost') as HTMLSpanElement;
const letBailey = document.getElementById('letBailey') as HTMLInputElement;
const discountInput = document.getElementById('discount_code') as HTMLInputElement;
const shippingLocationInput = document.getElementById('shipping_location') as HTMLSelectElement;
let discountAmount = 0;
let discountType: 'percent' | 'fixed' | null = null;

function updateCost() {
  let cost = 0;
  const delivery = form.delivery.value;
  let shippingLocation = shippingLocationInput.value;
  let shippingCost = shippingLocationPrices[shippingLocation] || 0;

  // If both are checked, cost = 0
  if (letBailey.checked && collectionInput && collectionInput.checked) {
    cost = 0;
  } else if (collectionInput && collectionInput.checked) {
    shippingCost = 0;
    shippingLocation = 'Collection';
    // Only count weight and plastic, ignore delivery and shipping
    const weight = parseInt(form.weight.value) || 0;
    const plastic = form.plastic.value;
    cost = (weight * (basePrices[plastic] || 0.05));
  } else if (letBailey.checked) {
    cost = deliveryPrices[delivery] + shippingCost;
  } else {
    const weight = parseInt(form.weight.value) || 0;
    const plastic = form.plastic.value;
    cost = (weight * (basePrices[plastic] || 0.05)) + deliveryPrices[delivery] + shippingCost;
  }

  let displayCost = cost;
  if (discountAmount && discountType) {
    if (discountType === 'percent') {
      displayCost = cost * (1 - discountAmount / 100);
    } else {
      displayCost = Math.max(0, cost - discountAmount);
    }
  }
  totalCostSpan.textContent = `£${displayCost.toFixed(2)}` + (discountAmount ? ` (discount applied)` : '');
}

// Discount code validation will be handled on submit only
form.addEventListener('input', updateCost);
if (collectionInput) collectionInput.addEventListener('change', updateCost);


function updateFieldDisabling() {
  // Only disable if letBailey is checked
  form.weight.disabled = letBailey.checked;
  form.plastic.disabled = letBailey.checked;
}

letBailey.addEventListener('change', function() {
  updateFieldDisabling();
  updateCost();
});

if (collectionInput) {
  collectionInput.addEventListener('change', function() {
    updateFieldDisabling();
    updateCost();
  });
}

// Initial state
updateFieldDisabling();

form.addEventListener('submit', async function(e) {
  e.preventDefault();

  const userId = localStorage.getItem('userId');
  if (!userId) {
    alert("Please log in to place an order");
    window.location.href = '/signup.html';
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  const originalButtonText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = 'Placing Order...';

  // Validate discount code if present
  let code = discountInput?.value.trim();
  discountAmount = 0;
  discountType = null;
  if (code) {
    try {
      const res = await fetch(`/api/discount/${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.success && data.discount) {
        discountAmount = parseFloat(data.discount.discount_value);
        discountType = data.discount.discount_type;
      } else {
        alert('Invalid or expired discount code');
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
        return;
      }
    } catch (e) {
      alert('Could not validate discount code');
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
      return;
    }
  }


  const formData = new FormData(form);
  const orderData = Object.fromEntries(formData);
  let shippingLocation = orderData.shipping_location as string;
  if (collectionInput && collectionInput.checked) {
    shippingLocation = 'Collection';
  }

  // Validate weight
  let weight = 0;
  if (!letBailey.checked) {
    weight = parseInt(orderData.weight as string);
    if (isNaN(weight) || weight <= 0) {
      alert('Please enter a valid weight in grams (must be a positive number).');
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
      return;
    }
  }

  // Validate plastic
  let plastic = 'pla';
  if (!letBailey.checked) {
    plastic = (orderData.plastic as string) || '';
    if (!basePrices.hasOwnProperty(plastic)) {
      alert('Please select a valid plastic type.');
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
      return;
    }
  }

  let cost = 0;
  const delivery = orderData.delivery as string;
  let shippingCost = shippingLocationPrices[shippingLocation] || 0;
  if (shippingLocation === 'Collection') shippingCost = 0;
  if (letBailey.checked) {
    cost = deliveryPrices[delivery] + shippingCost;
  } else {
    cost = (weight * (basePrices[plastic] || 0.05)) + deliveryPrices[delivery] + shippingCost;
  }

  let displayCost = cost;
  if (discountAmount && discountType) {
    if (discountType === 'percent') {
      displayCost = cost * (1 - discountAmount / 100);
    } else {
      displayCost = Math.max(0, cost - discountAmount);
    }
  }
  totalCostSpan.textContent = `£${displayCost.toFixed(2)}` + (discountAmount ? ` (discount applied)` : '');


  // Add collection/delivery info to description
  let fulfillmentType = (collectionInput && collectionInput.checked) ? 'Collection' : 'Delivery';
  const submitData = {
    user_id: parseInt(userId),
    model_name: orderData.model as string,
    weight: letBailey.checked ? 0 : weight,
    plastic: letBailey.checked ? 'pla' : plastic,
    delivery: delivery,
    shipping_location: shippingLocation,
    price: parseFloat(displayCost.toFixed(2)),
    fulfilled: false,
    description: `3D Print: ${orderData.model as string} - ${letBailey.checked ? 'pla' : plastic} - ${letBailey.checked ? 'Let Bailey handle weight' : weight + 'g'} (${fulfillmentType})`,
    amount: parseFloat(displayCost.toFixed(2)),
    delivery_time: delivery,
    status: 'pending',
    discount_code: code || null
  };

  console.log('Submitting order:', submitData);

  try {
    const response = await fetch('/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submitData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      submitButton.textContent = 'Order Placed!';
      submitButton.classList.remove('bg-violet-500', 'hover:bg-violet-600');
      submitButton.classList.add('bg-green-500');
      form.reset();
      updateCost();
      setTimeout(() => {
        window.location.href = '/account.html';
      }, 1000);
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error submitting order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Network error';
    alert(`Order failed: ${errorMessage}. Please try again.`);
  } finally {
    setTimeout(() => {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
      submitButton.classList.remove('bg-green-500');
      submitButton.classList.add('bg-violet-500', 'hover:bg-violet-600');
    }, 2000);
  }
});

updateCost();