const basePrices: Record<string, number> = { pla: 0.045, pbse: 0.145, abs: 0.295 };
const deliveryPrices: Record<string, number> = { standard: 0, fast: 2, express: 3.50 };
const form = document.getElementById('shopForm') as HTMLFormElement;
const totalCostSpan = document.getElementById('totalCost') as HTMLSpanElement;
const letBailey = document.getElementById('letBailey') as HTMLInputElement;

function updateCost() {
  let cost = 0;
  const delivery = form.delivery.value;
  if (letBailey.checked) {
    cost = deliveryPrices[delivery];
  } else {
    const weight = parseInt(form.weight.value) || 0;
    const plastic = form.plastic.value;
    cost = (weight * (basePrices[plastic] || 0.05)) + deliveryPrices[delivery];
  }
  totalCostSpan.textContent = `£${cost.toFixed(2)}`;
}

form.addEventListener('input', updateCost);

letBailey.addEventListener('change', function() {
  form.weight.disabled = letBailey.checked;
  form.plastic.disabled = letBailey.checked;
  updateCost();
});

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

  const formData = new FormData(form);
  const orderData = Object.fromEntries(formData);
  
  let cost = 0;
  const delivery = orderData.delivery as string;
  if (letBailey.checked) {
    cost = deliveryPrices[delivery];
  } else {
    const weight = parseInt(orderData.weight as string) || 0;
    const plastic = orderData.plastic as string;
    cost = (weight * (basePrices[plastic] || 0.05)) + deliveryPrices[delivery];
  }

  const submitData = {
    user_id: parseInt(userId),
    model_name: orderData.model as string,
    weight: letBailey.checked ? 0 : parseInt(orderData.weight as string),
    plastic: letBailey.checked ? 'pla' : orderData.plastic as string,
    delivery: delivery,
    price: parseFloat(cost.toFixed(2)),
    fulfilled: false,
    description: `3D Print: ${orderData.model as string} - ${letBailey.checked ? 'pla' : orderData.plastic as string} - ${letBailey.checked ? 'Let Bailey handle weight' : orderData.weight + 'g'}`,
    amount: parseFloat(cost.toFixed(2)),
    delivery_time: delivery,
    status: 'pending'
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