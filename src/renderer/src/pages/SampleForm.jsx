import React from 'react';
import { Form, Input, Textarea, Select, FileUpload } from '../components/Form';

const SampleForm = () => {
  const onSubmit = (data) => {
    // Form data will be logged to console and passed to this function
    console.log('Form submitted with data:', data);
    
    // Here you would typically make an API call
    // Example:
    // const response = await fetch('/api/endpoint', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(data),
    // });
    // const result = await response.json();
    // console.log('API Response:', result);
  };

  const categories = [
    { value: 'electronics', label: 'Electronics' },
    { value: 'clothing', label: 'Clothing' },
    { value: 'books', label: 'Books' },
    { value: 'home', label: 'Home & Kitchen' },
  ];

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Product Information</h1>
      
      <Form onSubmit={onSubmit} defaultValues={{
        // You can set default values here
        category: 'electronics',
      }}>
        {({ control }) => (
          <div className="space-y-4">
            <Input
              name="name"
              label="Product Name"
              control={control}
              placeholder="Enter product name"
              rules={{ required: 'Product name is required' }}
            />

            <Input
              name="price"
              label="Price"
              type="number"
              control={control}
              placeholder="Enter price"
              rules={{ 
                required: 'Price is required',
                min: { value: 0, message: 'Price must be positive' }
              }}
            />

            <Select
              name="category"
              label="Category"
              control={control}
              options={categories}
              rules={{ required: 'Category is required' }}
            />

            <Textarea
              name="description"
              label="Description"
              control={control}
              placeholder="Enter product description"
              rows={4}
              rules={{ required: 'Description is required' }}
            />

            <FileUpload
              name="images"
              label="Product Images"
              control={control}
              multiple={true}
              accept="image/*"
              rules={{ required: 'At least one image is required' }}
            />

            <div className="pt-4">
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Save Product
              </button>
            </div>
          </div>
        )}
      </Form>
    </div>
  );
};

export default SampleForm;
